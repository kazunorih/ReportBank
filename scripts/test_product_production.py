import importlib.util
import json
from decimal import Decimal
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("products", ROOT / "scripts/import-product-production.py")
products = importlib.util.module_from_spec(spec)
spec.loader.exec_module(products)


class ProductProductionTests(unittest.TestCase):
    def test_money_and_missing_cells(self):
        self.assertEqual(products.money(1234567, .001), 1234.567)
        self.assertEqual(products.money(0), 0)
        for value in ("X", "***", "-", None, ""):
            self.assertIsNone(products.money(value))

    def test_vehicle_grouping_does_not_absorb_parts_or_tractors(self):
        for code in ("0101", "0102", "0103"):
            self.assertEqual(products.product_name("車種", "2400", code), "乗用車")
        for code in ("0106", "0107", "0108"):
            self.assertEqual(products.product_name("車種", "2400", code), "トラック")
        for code in ("0112", "0113", "0114", "0115"):
            self.assertEqual(products.product_name("車種", "2400", code), "二輪自動車")
        self.assertEqual(products.product_name("トラック（けん引車）", "2400", "0109"), "トラック(けん引車)")
        self.assertEqual(products.product_name("普通トラック荷台", "2400", "0117"), "普通トラック荷台")
        self.assertEqual(products.product_name("気筒容積50ml以下", "legacy-motorcycles"), "二輪自動車")
        self.assertEqual(products.product_name("気筒容積125mlを超え250ml以下", "legacy-auto"), "二輪自動車")
        self.assertEqual(products.product_name("トラック（軽自動車）", "legacy-auto"), "トラック")

    def test_continuity_units_ranking_and_public_totals(self):
        data = json.loads((ROOT / "lib/reports/data/product-production.json").read_text(encoding="utf-8"), parse_float=Decimal)
        self.assertEqual([p["year"] for p in data["points"]], list(range(2007, 2026)))
        self.assertEqual(data["unit"], "百万円")
        self.assertEqual(len(data["series"]), 10)
        latest = data["points"][-1]
        self.assertEqual(latest["categories"]["乗用車"], Decimal(22460877))
        self.assertEqual(data["points"][0]["categories"]["二輪自動車"], Decimal(780036))
        self.assertEqual(next(p for p in data["points"] if p["year"] == 2017)["categories"]["化粧品"], Decimal("1544955.877"))
        expected = sorted((name for name, value in latest["categories"].items() if value is not None and name not in latest["partialCategories"]), key=latest["categories"].get, reverse=True)[:10]
        self.assertEqual([s["name"] for s in data["series"]], expected)
        source_ids = {source["id"] for source in data["sources"]}
        for point in data["points"]:
            self.assertLess(abs(sum(v for v in point["categories"].values() if v is not None) - point["total"]), Decimal("0.00001"))
            self.assertLess(abs(sum(point[s["key"]] for s in data["series"] if point[s["key"]] is not None) + point["other"] - point["total"]), Decimal("0.00001"))
            self.assertGreaterEqual(point["other"], 0)
            self.assertLess(point["total"], 200_000_000)  # Detect a thousand-yen/million-yen mix-up.
            self.assertTrue(set(point["sourceIds"]).issubset(source_ids))
            self.assertGreaterEqual(point["observedItems"], 400)
        self.assertTrue(all(len(s["sha256"]) == 64 for s in data["sources"]))


if __name__ == "__main__":
    unittest.main()
