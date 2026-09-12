import re
import logging
from datetime import datetime, timezone, date
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs

from app.services.alcon_catalog_service import alcon_catalog_service
from app.db import supabase

logger = logging.getLogger(__name__)


def parse_dioptria_float(val: Any) -> Optional[float]:
    """
    Convierte una representación de dioptría (+21.50, 21.5, '21.50 D', '-1.0') a float.
    """
    if val is None:
        return None
    s = str(val).strip().upper()
    s = s.replace("D", "").replace("+", "").replace(",", ".").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def parse_gs1_date(yymmdd: str) -> Optional[Dict[str, Any]]:
    """
    Convierte fecha GS1 YYMMDD a ISO YYYY-MM-DD y calcula si está vencido.
    """
    if not yymmdd or len(yymmdd) != 6 or not yymmdd.isdigit():
        return None

    yy = int(yymmdd[0:2])
    mm = int(yymmdd[2:4])
    dd = int(yymmdd[4:6])

    # Años 51-99 -> 1951-1999; 00-50 -> 2000-2050
    year = 1900 + yy if yy >= 51 else 2000 + yy

    if mm < 1 or mm > 12:
        return None

    # Si dd es 00, se toma el último día del mes
    if dd == 0:
        import calendar
        dd = calendar.monthrange(year, mm)[1]

    iso = f"{year:04d}-{mm:02d}-{dd:02d}"
    try:
        fecha_vto = date(year, mm, dd)
        hoy = date.today()
        esta_vencido = fecha_vto < hoy
        dias = (fecha_vto - hoy).days
        return {
            "iso": iso,
            "esta_vencido": esta_vencido,
            "dias": dias
        }
    except Exception:
        return None


def parse_gs1_string(raw_input: str) -> Dict[str, Any]:
    """
    Parsea una cadena proveniente de un escáner de código de barras GS1 (DataMatrix o QR).
    Soporta formato con paréntesis, stream continuo con FNC1/ASCII 29 (\x1d) y GS1 Digital Link.
    """
    result = {
        "gtin": None,
        "gtin_14": None,
        "lote": None,
        "vencimiento": None,
        "vencimiento_raw": None,
        "serie": None,
        "esta_vencido": False,
        "dias_para_vencer": None,
        "raw": raw_input or "",
        "es_valido": False,
        "formato": "desconocido"
    }

    if not raw_input or not isinstance(raw_input, str):
        return result

    raw = raw_input.strip()

    # 1. GS1 Digital Link (URL)
    if raw.startswith("http://") or raw.startswith("https://"):
        result["formato"] = "digital_link"
        try:
            parsed_url = urlparse(raw)
            parts = [p for p in parsed_url.path.split("/") if p]
            for i in range(0, len(parts) - 1, 2):
                ai = parts[i]
                val = parts[i + 1]
                if ai == "01":
                    result["gtin"] = val
                elif ai == "10":
                    result["lote"] = val
                elif ai == "17":
                    result["vencimiento_raw"] = val
                elif ai == "21":
                    result["serie"] = val

            qs = parse_qs(parsed_url.query)
            for k, v in qs.items():
                val = v[0] if v else ""
                if k in ("01", "gtin"):
                    result["gtin"] = val
                elif k in ("10", "lot"):
                    result["lote"] = val
                elif k in ("17", "exp"):
                    result["vencimiento_raw"] = val
                elif k in ("21", "ser"):
                    result["serie"] = val
        except Exception as e:
            logger.warning(f"Falla parseando Digital Link: {e}")

    # 2. Formato con identificadores entre paréntesis: (01)...(17)...(10)...
    if not result["gtin"] and "(01)" in raw:
        result["formato"] = "parentesis"
        m_gtin = re.search(r"\(01\)(\d{8,14})", raw)
        if m_gtin:
            result["gtin"] = m_gtin.group(1)

        m_vto = re.search(r"\(17\)(\d{6})", raw)
        if m_vto:
            result["vencimiento_raw"] = m_vto.group(1)

        m_lote = re.search(r"\(10\)([^()]+)", raw)
        if m_lote:
            result["lote"] = m_lote.group(1).strip()

        m_serie = re.search(r"\(21\)([^()]+)", raw)
        if m_serie:
            result["serie"] = m_serie.group(1).strip()

    # 3. Stream GS1 continuo con separador ASCII 29 (\x1d) o concatenación estándar
    if not result["gtin"]:
        GS = "\x1d"
        clean = raw.replace("<GS>", GS).replace("^]", GS)

        if re.match(r"^01\d{14}", clean):
            result["formato"] = "stream_fnc1"
            result["gtin"] = clean[2:16]
            rem = clean[16:]

            while rem:
                if rem.startswith(GS):
                    rem = rem[1:]
                    continue

                # AI 17: Expiración (6 dígitos)
                if rem.startswith("17") and len(rem) >= 8 and rem[2:8].isdigit():
                    result["vencimiento_raw"] = rem[2:8]
                    rem = rem[8:]
                    continue

                # AI 10: Lote (longitud variable)
                if rem.startswith("10"):
                    rem = rem[2:]
                    next_gs = rem.find(GS)
                    if next_gs != -1:
                        result["lote"] = rem[:next_gs]
                        rem = rem[next_gs + 1:]
                    else:
                        m_next = re.search(r"(17\d{6}|21[a-zA-Z0-9]+)$", rem)
                        if m_next and m_next.start() > 0:
                            result["lote"] = rem[:m_next.start()]
                            rem = rem[m_next.start():]
                        else:
                            result["lote"] = rem
                            rem = ""
                    continue

                # AI 21: Serie (longitud variable)
                if rem.startswith("21"):
                    rem = rem[2:]
                    next_gs = rem.find(GS)
                    if next_gs != -1:
                        result["serie"] = rem[:next_gs]
                        rem = rem[next_gs + 1:]
                    else:
                        result["serie"] = rem
                        rem = ""
                    continue

                rem = rem[1:]

    # 4. Fallback: GTIN o código de barras directo de 12 a 14 dígitos
    if not result["gtin"] and re.match(r"^\d{12,14}$", raw):
        result["formato"] = "gtin_puro"
        result["gtin"] = raw

    # Normalizar GTIN-14
    if result["gtin"]:
        digits_only = re.sub(r"\D", "", result["gtin"])
        result["gtin_14"] = digits_only.zfill(14)

    # Validar fecha de expiración
    if result["vencimiento_raw"]:
        f_info = parse_gs1_date(result["vencimiento_raw"])
        if f_info:
            result["vencimiento"] = f_info["iso"]
            result["esta_vencido"] = f_info["esta_vencido"]
            result["dias_para_vencer"] = f_info["dias"]

    result["es_valido"] = bool(result["gtin"] or (result["lote"] and result["vencimiento"]))
    return result


def buscar_info_lio_por_gtin(gtin: str) -> Optional[Dict[str, Any]]:
    """
    Busca los datos de un lente por GTIN consultando:
    1. Tabla Supabase `catalogo_maestro_gtin`
    2. Catálogo interno de 3.895 SKUs `alcon_catalog_service`
    3. Tabla `modelos_lio_items`
    """
    if not gtin:
        return None

    digits = re.sub(r"\D", "", str(gtin))
    g14 = digits.zfill(14)
    g12 = digits.lstrip("0")

    # 1. Consulta en catalogo_maestro_gtin (Supabase)
    if supabase:
        try:
            res = (
                supabase.table("catalogo_maestro_gtin")
                .select("*, modelos_lio(id, modelo, marca, tipo_optica, constante_a)")
                .or_(f"gtin_14.eq.{g14},gtin_12.eq.{g12},geclisa_ele_cod.eq.{g14},geclisa_ele_cod.eq.{g12}")
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                mod = row.get("modelos_lio") or {}
                return {
                    "gtin_14": row.get("gtin_14") or g14,
                    "gtin_12": row.get("gtin_12") or g12,
                    "marca": row.get("marca") or mod.get("marca") or "Alcon",
                    "modelo": mod.get("modelo") or row.get("familia_nombre") or row.get("nombre_producto"),
                    "nombre_producto": row.get("nombre_producto") or mod.get("modelo"),
                    "tipo_optica": row.get("tipo_optica") or mod.get("tipo_optica"),
                    "dioptria": row.get("dioptria"),
                    "es_torico": bool(row.get("es_torico")),
                    "torico_valor": row.get("torico_valor"),
                    "constante_a": row.get("constante_a") or mod.get("constante_a"),
                    "origen": "catalogo_maestro_gtin"
                }
        except Exception as e:
            logger.warning(f"Error consultando catalogo_maestro_gtin por GTIN {gtin}: {e}")

    # 2. Consulta en alcon_catalog_service (3.895 SKUs)
    match_alcon = alcon_catalog_service.buscar_por_gtin(g14)
    if match_alcon:
        return {
            "gtin_14": match_alcon.get("gtin_14") or g14,
            "gtin_12": match_alcon.get("gtin_12") or g12,
            "marca": match_alcon.get("marca", "Alcon"),
            "modelo": match_alcon.get("familia_nombre") or match_alcon.get("nombre_producto"),
            "nombre_producto": match_alcon.get("nombre_producto"),
            "tipo_optica": match_alcon.get("tipo_optica"),
            "dioptria": match_alcon.get("dioptria"),
            "es_torico": bool(match_alcon.get("es_torico")),
            "torico_valor": match_alcon.get("torico_valor"),
            "constante_a": match_alcon.get("constante_a"),
            "origen": "alcon_catalog_service"
        }

    # 3. Consulta en modelos_lio_items
    if supabase:
        try:
            res_item = (
                supabase.table("modelos_lio_items")
                .select("*, modelos_lio(id, modelo, marca, tipo_optica, constante_a)")
                .or_(f"geclisa_ele_cod.eq.{g14},geclisa_ele_cod.eq.{g12}")
                .limit(1)
                .execute()
            )
            if res_item.data:
                row_item = res_item.data[0]
                mod = row_item.get("modelos_lio") or {}
                return {
                    "gtin_14": g14,
                    "gtin_12": g12,
                    "marca": mod.get("marca") or "Alcon",
                    "modelo": mod.get("modelo") or row_item.get("geclisa_nombre"),
                    "nombre_producto": row_item.get("geclisa_nombre") or mod.get("modelo"),
                    "tipo_optica": mod.get("tipo_optica"),
                    "dioptria": row_item.get("dioptria"),
                    "es_torico": bool(row_item.get("es_torico")),
                    "torico_valor": row_item.get("torico_valor"),
                    "constante_a": mod.get("constante_a"),
                    "origen": "modelos_lio_items"
                }
        except Exception as e:
            logger.warning(f"Error consultando modelos_lio_items por GTIN {gtin}: {e}")

    return None


def validar_lente_blister_contra_turno(turno: Dict[str, Any], datos_gs1: Dict[str, Any]) -> Dict[str, Any]:
    """
    Efectúa la validación cruzada entre los datos del turno quirúrgico (plan biométrico previsto)
    y los datos decodificados del blíster físico (GS1 DataMatrix / QR).
    """
    gtin = datos_gs1.get("gtin_14") or datos_gs1.get("gtin")
    info_catalogo = buscar_info_lio_por_gtin(gtin) if gtin else None

    # Datos planificados del turno
    plan_modelo = str(turno.get("lente_tipo") or "").strip()
    plan_dioptria_float = parse_dioptria_float(turno.get("lente_dioptria"))
    plan_es_torico = bool(turno.get("es_torico"))
    plan_torico_valor = str(turno.get("lente_torico_valor") or "").strip().upper().replace("T", "")

    # Datos escaneados del blíster
    scan_marca = (info_catalogo.get("marca") if info_catalogo else None) or "Desconocida"
    scan_modelo = (info_catalogo.get("modelo") if info_catalogo else None) or "LIO Genérico"
    scan_nombre = (info_catalogo.get("nombre_producto") if info_catalogo else None) or scan_modelo
    scan_dioptria_raw = info_catalogo.get("dioptria") if info_catalogo else None
    scan_dioptria_float = parse_dioptria_float(scan_dioptria_raw)
    scan_es_torico = bool(info_catalogo.get("es_torico")) if info_catalogo else False
    scan_torico_valor = str(info_catalogo.get("torico_valor") or "").strip().upper().replace("T", "") if info_catalogo else ""

    lote = datos_gs1.get("lote") or "N/D"
    serie = datos_gs1.get("serie") or "N/D"
    vencimiento = datos_gs1.get("vencimiento")
    esta_vencido = bool(datos_gs1.get("esta_vencido"))

    discrepancias: List[str] = []

    # 1. Chequeo de caducidad biológica
    if esta_vencido:
        discrepancias.append(f"⛔ LENTE VENCIDO: La fecha de caducidad del blíster es {vencimiento}.")

    # 2. Chequeo de existencia en catálogo
    if not info_catalogo:
        discrepancias.append(
            f"El código GTIN '{gtin}' no se encuentra catalogado en el CRM ni en la base Alcon. "
            f"Verifique manualmente los parámetros antes de proceder."
        )

    # 3. Chequeo de dioptría
    if plan_dioptria_float is not None and scan_dioptria_float is not None:
        diff = abs(plan_dioptria_float - scan_dioptria_float)
        if diff > 0.05:
            discrepancias.append(
                f"Dioptría DISCREPANTE: Planificado {plan_dioptria_float:+.2f} D vs Blíster Escaneado {scan_dioptria_float:+.2f} D"
            )

    # 4. Chequeo de toricity
    if plan_es_torico != scan_es_torico and info_catalogo:
        tipo_plan = "TÓRICO" if plan_es_torico else "NO TÓRICO"
        tipo_scan = "TÓRICO" if scan_es_torico else "NO TÓRICO"
        discrepancias.append(f"Diseño Óptico DISCREPANTE: El plan estipula lente {tipo_plan}, pero el blíster es {tipo_scan}.")
    elif plan_es_torico and scan_es_torico and plan_torico_valor and scan_torico_valor:
        if plan_torico_valor != scan_torico_valor:
            discrepancias.append(
                f"Cilindro Tórico DISCREPANTE: Planificado T{plan_torico_valor} vs Blíster Escaneado T{scan_torico_valor}"
            )

    # 5. Chequeo orientativo de modelo
    if plan_modelo and scan_modelo and info_catalogo:
        norm_plan = re.sub(r"[^a-zA-Z0-9]", "", plan_modelo.lower())
        norm_scan = re.sub(r"[^a-zA-Z0-9]", "", scan_modelo.lower())
        norm_prod = re.sub(r"[^a-zA-Z0-9]", "", scan_nombre.lower())

        # Si ninguno contiene al otro y no hay coincidencia cruzada
        if norm_plan not in norm_scan and norm_scan not in norm_plan and norm_plan not in norm_prod:
            # Si uno es clareon y el otro no, o uno es panoptix y el otro no
            if any(k in norm_plan for k in ["clareon", "panoptix", "vivity", "sn60wf"]) or any(k in norm_scan for k in ["clareon", "panoptix", "vivity", "sn60wf"]):
                discrepancias.append(
                    f"Modelo DISCREPANTE: Planificado '{plan_modelo}' vs Blíster Escaneado '{scan_nombre}'"
                )

    # Determinar estado de validación
    if esta_vencido:
        estado_validacion = "LENTE_VENCIDO"
        coincide = False
    elif not info_catalogo:
        estado_validacion = "GTIN_NO_CATALOGADO"
        coincide = False
    elif len(discrepancias) > 0:
        estado_validacion = "DISCREPANCIA"
        coincide = False
    else:
        estado_validacion = "COINCIDENCIA_TOTAL"
        coincide = True

    return {
        "success": True,
        "coincide": coincide,
        "estado_validacion": estado_validacion,
        "mensaje": (
            "✔ Lente Verificado y Conforme con el Plan Quirúrgico."
            if coincide
            else "🚨 Se detectaron discrepancias o advertencias críticas con el lente escaneado."
        ),
        "discrepancias": discrepancias,
        "escaneado": {
            "gtin": gtin,
            "marca": scan_marca,
            "modelo": scan_modelo,
            "nombre_producto": scan_nombre,
            "dioptria": scan_dioptria_float,
            "dioptria_str": f"{scan_dioptria_float:+.2f} D" if scan_dioptria_float is not None else "N/D",
            "es_torico": scan_es_torico,
            "torico_valor": f"T{scan_torico_valor}" if scan_torico_valor else None,
            "lote": lote,
            "serie": serie,
            "vencimiento": vencimiento,
            "esta_vencido": esta_vencido,
            "dias_para_vencer": datos_gs1.get("dias_para_vencer"),
            "origen_catalogo": info_catalogo.get("origen") if info_catalogo else None
        },
        "planificado": {
            "modelo": plan_modelo,
            "dioptria": f"{plan_dioptria_float:+.2f} D" if plan_dioptria_float is not None else str(turno.get("lente_dioptria") or "N/D"),
            "dioptria_float": plan_dioptria_float,
            "es_torico": plan_es_torico,
            "torico_valor": f"T{plan_torico_valor}" if plan_torico_valor else None,
            "ojo": turno.get("ojo", "OD")
        }
    }
