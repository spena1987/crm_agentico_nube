import os
import sys
import unittest
from unittest.mock import patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.db import _PACIENTES_RESUMEN_COLS
from app.services import pdf_service


def _make_turno(idx: int, **overrides):
    base = {
        "id": f"aaaa0000-0000-0000-0000-0000000000{idx:02d}",
        "paciente_id": f"deadbeef-1111-2222-3333-0000000000{idx:02d}",
        "fecha_cirugia": "2026-11-24",
        "hora_inicio": "08:00:00",
        "ojo": "OD" if idx % 2 == 0 else "OI",
        "cirujano_nombre": "LABAT, CARLOS ANDRES",
        "medico_derivador_nombre": "LOPEZ DALE, RAFAEL",
        "anestesiologo_nombre": "Estelrich, Gustavo",
        "tipo_anestesia": "Local Asistida + Sedación",
        "lleva_lente": True,
        "lio_calculado": True,
        "lente_tipo": "Clareon Monofocal (Alcon)",
        "lente_dioptria": "21.5",
        "lente_incision_grados": 180,
        "practica_nombre": "FACOEMULSIFICACION + LIO",
        "pacientes": {
            "id": f"deadbeef-1111-2222-3333-0000000000{idx:02d}",
            "nombre": f"PACIENTE TEST {idx}",
            "dni": "12345678",
            "nro_hc": str(421200 + idx),
            "geclisa_ficha_id": 999000 + idx,
        },
    }
    base.update(overrides)
    return base


class TestPlanillaQuirofanoPDF(unittest.TestCase):
    def test_db_projection_includes_nro_hc(self):
        cols = [c.strip() for c in _PACIENTES_RESUMEN_COLS.split(",")]
        self.assertIn("nro_hc", cols)

    def test_12_columns_hc_anestesia_and_sin_lio_spans(self):
        captured = {}
        real_table = pdf_service.Table

        def spy_table(data, *args, **kwargs):
            if "colWidths" in kwargs and len(kwargs["colWidths"]) == 12:
                captured["data"] = data
                captured["colWidths"] = kwargs["colWidths"]
                captured["table_obj"] = real_table(data, *args, **kwargs)
                return captured["table_obj"]
            return real_table(data, *args, **kwargs)

        real_tablestyle = pdf_service.TableStyle

        def spy_tablestyle(cmds, *args, **kwargs):
            captured["style_cmds"] = list(cmds)
            return real_tablestyle(cmds, *args, **kwargs)

        turnos = [
            # Row 1: con LIO, 0 D / 0° incision & axis, nro_hc present, tipo_anestesia present
            _make_turno(
                1,
                lente_dioptria=0,
                lente_incision_grados=0,
                es_torico=True,
                lente_torico_valor="2",
                lente_torico_eje=0,
                ojo="OD",
            ),
            # Row 2: Sin LIO with empty obs_med & residual LIO fields + missing nro_hc & missing tipo_anestesia
            _make_turno(
                2,
                lleva_lente=False,
                lente_tipo="Sin LIO",
                lente_dioptria="22.0",
                lente_incision_grados=90,
                es_torico=True,
                practica_nombre="COLOCACION INYECCION INTRAVITREA CON AVASTIN & EYLEA",
                observaciones_quirofano="",
                tipo_anestesia=None,
                ojo="OI",
                pacientes={
                    "id": "abcdef12-0000-0000-0000-000000000002",
                    "nombre": "FERNANDEZ, DELIA",
                    "dni": "4735372",
                    "nro_hc": None,
                },
            ),
            # Row 3: Sin LIO with obs_med="eylia" -> 2-col SPAN (6..7)
            _make_turno(
                3,
                lleva_lente=False,
                lente_tipo="",
                lente_dioptria=None,
                practica_nombre="INYECCION INTRAVITREA <25G>",
                observaciones_quirofano="eylia",
                ojo="AO",
            ),
        ]

        with (
            patch.object(pdf_service, "obtener_o_cachear_logo_local", return_value=None),
            patch.object(pdf_service, "Table", side_effect=spy_table),
            patch.object(pdf_service, "TableStyle", side_effect=spy_tablestyle),
        ):
            pdf_bytes, sha = pdf_service.generar_pdf_planilla_quirofano_diaria(
                turnos=turnos,
                fecha_str="2026-11-24",
                config_override={"nombre_institucion": "Centrovisión Test"},
                turnos_historial_pacientes={},
            )

        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertEqual(len(sha), 64)

        self.assertEqual(len(captured["colWidths"]), 12)
        self.assertAlmostEqual(sum(captured["colWidths"]), 793.8, places=1)

        header_texts = [p.text for p in captured["data"][0]]
        self.assertNotIn("H. PAC.", header_texts)
        self.assertNotIn("OBRA SOCIAL", header_texts)
        self.assertIn("LENTE / PRÁCTICA", header_texts)

        cmds = captured["style_cmds"]
        # OJO background in col 5
        self.assertTrue(any(c[0] == "BACKGROUND" and c[1] == (5, 1) for c in cmds))
        self.assertTrue(any(c[0] == "BACKGROUND" and c[1] == (5, 2) for c in cmds))

        # Row 1: 0 D, 0°, nro_hc 421201, tipo_anestesia without anestesiologo
        row1 = captured["data"][1]
        self.assertEqual(row1[2].text, "421201")
        self.assertIn("0 D", row1[7].text)
        self.assertIn("Inc:</b> 0°", row1[8].text)
        self.assertIn("EJE:</b> 0°", row1[8].text)
        self.assertEqual(row1[11].text, "Local Asistida + Sedación")
        self.assertNotIn("Estelrich", row1[11].text)

        # Row 2: missing nro_hc -> "-", missing tipo_anestesia -> "-", 3-col SPAN (6..8)
        row2 = captured["data"][2]
        self.assertEqual(row2[2].text, "-")
        self.assertNotIn("deadbe", row2[2].text)
        self.assertEqual(row2[11].text, "-")
        self.assertIn("AVASTIN &amp; EYLEA", row2[6].text)
        self.assertEqual(row2[7], "")
        self.assertEqual(row2[8], "")
        self.assertIn(("SPAN", (6, 2), (8, 2)), cmds)

        # Row 3: Sin LIO with obs_med="eylia" -> 2-col SPAN (6..7), obs in col 8
        row3 = captured["data"][3]
        self.assertIn("&lt;25G&gt;", row3[6].text)
        self.assertEqual(row3[7], "")
        self.assertEqual(row3[8].text, "eylia")
        self.assertIn(("SPAN", (6, 3), (7, 3)), cmds)

    def test_23_rows_multipage_generation(self):
        turnos = [_make_turno(i) for i in range(1, 24)]
        with patch.object(pdf_service, "obtener_o_cachear_logo_local", return_value=None):
            pdf_bytes, sha = pdf_service.generar_pdf_planilla_quirofano_diaria(
                turnos=turnos,
                fecha_str="2026-11-24",
                config_override={"nombre_institucion": "Centrovisión Test"},
                turnos_historial_pacientes={},
            )
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertEqual(len(sha), 64)
        # Verify multipage output (~10 rows/page -> >= 2 pages)
        page_count = pdf_bytes.count(b"/Type /Page\n") + pdf_bytes.count(b"/Type /Page\r")
        if page_count == 0:
            # Fallback check on ReportLab page count marker
            self.assertGreater(len(pdf_bytes), 3000)
        else:
            self.assertGreaterEqual(page_count, 2)


if __name__ == "__main__":
    unittest.main()
