import unittest
from pathlib import Path
from lending import parse_lending_csv


class LendingTests(unittest.TestCase):
    def setUp(self):
        self.raw = (Path(__file__).parent / "data" / "lending-la01.csv").read_bytes()

    def test_attached_quarters_and_units_exclude_empty_future_rows(self):
        rows = parse_lending_csv(self.raw)
        self.assertEqual(len(rows), 126)
        self.assertEqual(rows[0]["date"], "1995-03-31")
        self.assertEqual(rows[-1], {"date": "2026-06-30", "domesticBankLoans": 675.0336, "housingLoans": 159.7284})

    def test_rejects_wrong_series_duplicate_dates_and_invalid_amounts(self):
        for bad in (self.raw.replace(b"DLLILKG90", b"UNKNOWN"),
                    self.raw.replace(b"1995/06", b"1995/03"),
                    self.raw.replace(b"5060794", b"NaN"),
                    self.raw.replace(b"5060794", b"100")):
            with self.assertRaises(ValueError):
                parse_lending_csv(bad)
