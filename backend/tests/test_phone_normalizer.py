import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.phone_normalizer import (
    clean_phone_digits,
    normalize_phone_number,
    format_phone_display,
    phone_to_whatsapp_jid
)

class TestPhoneNormalizer(unittest.TestCase):

    def test_clean_phone_digits(self):
        self.assertEqual(clean_phone_digits("+54 9 11 1234-5678"), "5491112345678")
        self.assertEqual(clean_phone_digits("(011) 15-4444.5555"), "0111544445555")
        self.assertEqual(clean_phone_digits("5491112345678@s.whatsapp.net"), "5491112345678")
        self.assertEqual(clean_phone_digits(""), "")
        self.assertEqual(clean_phone_digits(None), "")

    def test_argentina_standard_with_plus(self):
        self.assertEqual(normalize_phone_number("+54 9 11 1234-5678"), "5491112345678")
        self.assertEqual(normalize_phone_number("+54 9 351 444-5555"), "5493514445555")

    def test_argentina_local_with_0_and_15(self):
        # 011 15-1234-5678 -> 5491112345678
        self.assertEqual(normalize_phone_number("011 15-1234-5678"), "5491112345678")
        # 0351 15 444-5555 -> 5493514445555
        self.assertEqual(normalize_phone_number("0351 15 444-5555"), "5493514445555")
        # 0223 15 555-1234 -> 5492235551234
        self.assertEqual(normalize_phone_number("0223 15 555-1234"), "5492235551234")

    def test_argentina_10_digits_without_0_or_15(self):
        # 11 1234 5678 -> 5491112345678
        self.assertEqual(normalize_phone_number("1112345678"), "5491112345678")
        # 351 444 5555 -> 5493514445555
        self.assertEqual(normalize_phone_number("3514445555"), "5493514445555")

    def test_argentina_54_without_9(self):
        # 54 11 1234 5678 -> 5491112345678
        self.assertEqual(normalize_phone_number("541112345678"), "5491112345678")
        self.assertEqual(normalize_phone_number("54 351 444 5555"), "5493514445555")

    def test_argentina_with_15_in_10_or_12_digits(self):
        # 11 15 1234 5678 -> 5491112345678
        self.assertEqual(normalize_phone_number("111512345678"), "5491112345678")
        # 351 15 444 5555 -> 5493514445555
        self.assertEqual(normalize_phone_number("351154445555"), "5493514445555")

    def test_argentina_8_digits_local(self):
        # 4444-5555 -> 5491144445555 (default area 11)
        self.assertEqual(normalize_phone_number("4444-5555"), "5491144445555")
        # 15-4444-5555 -> 5491144445555
        self.assertEqual(normalize_phone_number("15-4444-5555"), "5491144445555")

    def test_international_numbers(self):
        # USA
        self.assertEqual(normalize_phone_number("+1 (555) 123-4567"), "15551234567")
        # Chile
        self.assertEqual(normalize_phone_number("+56 9 1234 5678"), "56912345678")
        # España
        self.assertEqual(normalize_phone_number("+34 612 345 678"), "34612345678")
        # Uruguay
        self.assertEqual(normalize_phone_number("+598 99 123 456"), "59899123456")

    def test_format_display(self):
        self.assertEqual(format_phone_display("011 15 1234-5678"), "+54 9 11 1234-5678")
        self.assertEqual(format_phone_display("0351 15 444-5555"), "+54 9 351 444-5555")
        self.assertEqual(format_phone_display("+15551234567"), "+15551234567")

    def test_phone_to_jid(self):
        jid = phone_to_whatsapp_jid("011 15 1234-5678")
        # Check that user is 5491112345678
        if hasattr(jid, "User"):
            self.assertEqual(jid.User, "5491112345678")
        else:
            self.assertEqual(str(jid), "5491112345678@s.whatsapp.net")

if __name__ == "__main__":
    unittest.main()
