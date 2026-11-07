import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("totals", ROOT / "scripts/import-gdp-totals.py")
totals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(totals)


class GdpTotalsTests(unittest.TestCase):
    def test_published_series_and_2025(self):
        data = json.loads((ROOT / "lib/reports/data/gdp-totals.json").read_text(encoding="utf-8"))
        self.assertEqual([p["year"] for p in data["points"]], list(range(1994, 2026)))
        self.assertEqual(data["points"][-1], dict(year=2025, nominal=666440.7, real=593689.9))
        self.assertEqual(data["realBaseYear"], 2020)
        self.assertTrue(all(p["real"] > 0 and p["nominal"] > 0 for p in data["points"]))
        self.assertTrue(all(len(s["sha256"]) == 64 for s in data["sources"]))

    def test_calendar_parser_and_fiscal_rejection(self):
        text = '"Nominal, Calendar Year"\n,GDP(Expenditure Approach)\n' + '\n'.join(f'{y}/1-12.,"500,000.1"' for y in range(1994, 2026))
        self.assertEqual(totals.parse(text.encode("cp932"), "nominal")[2025], 500000.1)
        with self.assertRaisesRegex(ValueError, "calendar-year"):
            totals.parse(text.replace("Calendar Year", "Fiscal Year").encode("cp932"), "nominal")
        with self.assertRaisesRegex(ValueError, "complete"):
            totals.parse(text.replace('2025/1-12.,"500,000.1"', '').encode("cp932"), "nominal")


if __name__ == "__main__":
    unittest.main()
