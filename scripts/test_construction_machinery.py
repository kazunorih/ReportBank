import importlib.util
import json
from pathlib import Path
import unittest
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cema", ROOT / "scripts/import-construction-machinery.py")
cema = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cema)


class ConstructionMachineryTests(unittest.TestCase):
    def test_years_classifications_and_totals(self):
        data = json.loads((ROOT / "lib/reports/data/construction-machinery.json").read_text(encoding="utf-8"))
        self.assertEqual([p["year"] for p in data["points"]], list(range(1995, 2027)))
        self.assertEqual(len(data["series"]), 5)
        ranking = next(p for p in data["points"] if p["year"] == data["rankingYear"])
        expected = sorted((k for k in ranking["categories"] if "その他" not in k), key=ranking["categories"].get, reverse=True)[:5]
        self.assertEqual([s["name"] for s in data["series"]], expected)
        for point in data["points"]:
            self.assertEqual(point["months"], 9 if point["year"] == 2026 else 12)
            self.assertEqual(sum(point["categories"].values()), point["total"])
            self.assertEqual(sum(point[s["key"]] for s in data["series"]) + point["other"], point["total"])
            self.assertGreaterEqual(point["other"], 0)
        self.assertEqual(data["points"][-1]["total"], 2714780)
        self.assertEqual({s["year"] for s in data["sources"]}, set(range(1995, 2027)))

    def test_fiscal_total_is_not_used_and_corrupt_totals_are_rejected(self):
        rows = [{"A": "1995年", "X": "百万円"}]
        for name in ("トラクタ", "総合計"):
            for kind, amount in [("国内", 3), ("輸出", 7), ("小計", 10)]:
                rows.append({"A": name, "B": kind, "C": Decimal(amount), "W": Decimal(amount), "X": Decimal(99999)})
        self.assertEqual(cema.parse(rows, 1995)["total"], 10)
        rows[-1]["W"] = Decimal(20)
        with self.assertRaisesRegex(ValueError, "Calendar cumulative"):
            cema.parse(rows, 1995)


if __name__ == "__main__":
    unittest.main()
