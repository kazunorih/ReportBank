"""Verify published FIGURE04 data and GDP reconciliation guards."""
import importlib.util
import json
from decimal import Decimal
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gdp", ROOT / "scripts/import-gdp.py")
gdp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gdp)


class GdpTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "lib/reports/data/gdp.json").read_text(encoding="utf-8"), parse_float=Decimal)

    def test_ten_largest_industries_use_latest_year(self):
        latest = self.data["points"][-1]
        expected = sorted((f"sector{i}" for i in range(1, 16)), key=lambda key: latest[key], reverse=True)[:10]
        self.assertEqual([s["key"] for s in self.data["series"]], expected)
        self.assertEqual(self.data["rankingYear"], latest["year"])
        self.assertIn("農林水産業", self.data["otherIndustries"])
        self.assertIn("sector3", expected)
        self.assertIn("sector10", expected)
        self.assertNotIn("sector16", expected)
        self.assertIn("その他のサービス", self.data["otherIndustries"])
        self.assertNotIn("金融・保険業", self.data["otherIndustries"])

    def test_every_stack_equals_official_gdp(self):
        keys = [s["key"] for s in self.data["series"]]
        self.assertEqual([p["year"] for p in self.data["points"]], list(range(1994, 2025)))
        for point in self.data["points"]:
            self.assertEqual(sum(point[k] for k in keys) + point["other"], point["total"])
            industry_sum = sum(point[f"sector{i}"] for i in range(1, 17))
            self.assertLessEqual(abs(industry_sum - point["subtotal"]), Decimal("1"))
            adjusted = point["subtotal"] + point["importTaxes"] - point["capitalFormationTax"] + point["statisticalDiscrepancy"]
            self.assertLessEqual(abs(adjusted - point["total"]), Decimal("0.2"))

    def test_matches_figure02_vintage_and_values(self):
        production = json.loads((ROOT / "lib/reports/data/production.json").read_text(encoding="utf-8"), parse_float=Decimal)
        self.assertEqual(self.data["source"], next(s for s in production["sources"] if s["id"] == "industry"))
        for point, factory in zip(self.data["points"], production["industry"], strict=True):
            self.assertEqual(point["sector3"], factory["manufacturing"])
            self.assertEqual(point["sector5"], factory["construction"])

    def test_rejects_corrupted_source_total(self):
        # The existing JSON provides a portable source-shaped fixture, so this test
        # does not depend on ignored cached workbooks or network access.
        rows = [{"A": "名目"}, {"A": "１０億円"}, {"B": Decimal(1994)}]
        point = self.data["points"][0]
        for i, name in enumerate(gdp.NAMES, 1):
            rows.append({"A": f"{i}．{name}", "B": point[f"sector{i}"]})
        for label, key in [("小計", "subtotal"), ("輸入品に課される税・関税", "importTaxes"),
                           ("（控除）総資本形成に係る消費税", "capitalFormationTax"),
                           ("統計上の不突合", "statisticalDiscrepancy"), ("国内総生産", "total")]:
            rows.append({"A": label, "B": point[key]})
        parsed = gdp.parse(rows)
        self.assertEqual(parsed["points"][0]["total"], float(point["total"]))
        rows[-1]["B"] += 100
        with self.assertRaisesRegex(ValueError, "reconciliation"):
            gdp.parse(rows)


if __name__ == "__main__":
    unittest.main()
