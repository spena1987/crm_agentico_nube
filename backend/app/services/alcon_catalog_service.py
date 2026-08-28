import os
import json
import logging
import re
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

CATALOG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "alcon_gtin_catalog.json")

class AlconCatalogService:
    _instance = None
    _catalog: List[Dict[str, Any]] = []
    _lookup_14: Dict[str, Dict[str, Any]] = {}
    _lookup_12: Dict[str, Dict[str, Any]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AlconCatalogService, cls).__new__(cls)
            cls._instance._load_catalog()
        return cls._instance

    def _load_catalog(self):
        if not os.path.exists(CATALOG_PATH):
            logger.warning(f"No se encontró el archivo de catálogo Alcon en {CATALOG_PATH}")
            return

        try:
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                self._catalog = json.load(f)

            for item in self._catalog:
                g14 = str(item.get("gtin_14", "")).strip()
                g12 = str(item.get("gtin_12", "")).strip()
                if g14:
                    self._lookup_14[g14] = item
                if g12:
                    self._lookup_12[g12] = item

            logger.info(f"[ALCON_CATALOG] Catálogo Alcon cargado exitosamente con {len(self._catalog)} SKUs indexados.")
        except Exception as e:
            logger.error(f"[ALCON_CATALOG] Error al cargar catálogo Alcon: {e}")

    def buscar_por_gtin(self, gtin: str) -> Optional[Dict[str, Any]]:
        """
        Busca un SKU en el catálogo Alcon por código GTIN (a 14 o 12 dígitos).
        """
        if not gtin:
            return None
        clean = str(gtin).strip()
        clean_14 = clean.zfill(14)
        clean_12 = clean.lstrip("0")

        return self._lookup_14.get(clean_14) or self._lookup_12.get(clean) or self._lookup_12.get(clean_12)

    def cruzar_elementos_geclisa(self, elementos_geclisa: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Cruza una lista de elementos traídos de Geclisa contra el catálogo maestro de Alcon.
        Devuelve las coincidencias enriquecidas con la parametrización clínica.
        """
        coincidencias = []
        for el in elementos_geclisa:
            ele_id = el.get("eleId")
            ele_cod = str(el.get("eleCod") or "").strip()
            ele_nombre = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(el.get("eleNombre") or "")).strip()
            stock = float(el.get("stockActual") or 0.0)

            # Buscar por GTIN
            match = self.buscar_por_gtin(ele_cod)
            if match:
                coincidencias.append({
                    "geclisa_ele_id": ele_id,
                    "geclisa_ele_cod": ele_cod,
                    "geclisa_nombre": ele_nombre,
                    "stock_actual": stock,
                    "marca": match["marca"],
                    "familia_nombre": match["familia_nombre"],
                    "tipo_optica": match["tipo_optica"],
                    "constante_a": match["constante_a"],
                    "acd_estimado": match["acd_estimado"],
                    "dioptria": match["dioptria"],
                    "es_torico": match["es_torico"],
                    "torico_valor": match["torico_valor"],
                    "internacional": match["internacional"],
                    "nombre_producto": match["nombre_producto"],
                    "admite_toricos": match["admite_toricos"],
                    "apto_sulcus": match["apto_sulcus"]
                })
        return coincidencias

alcon_catalog_service = AlconCatalogService()
