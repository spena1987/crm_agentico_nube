import pytest
from app.services.pdf_service import parse_and_format_date

def test_parse_and_format_date_standard_iso():
    assert parse_and_format_date("2026-11-20") == "20/11/2026"
    assert parse_and_format_date("2026-01-05") == "05/01/2026"
    assert parse_and_format_date("2026-12-31T15:30:00Z") == "31/12/2026"

def test_parse_and_format_date_already_argentine():
    assert parse_and_format_date("20/11/2026") == "20/11/2026"

def test_parse_and_format_date_empty_or_fallback():
    res = parse_and_format_date("")
    assert len(res) == 10
    assert "/" in res
    res_none = parse_and_format_date(None)
    assert len(res_none) == 10
    assert "/" in res_none
