"""Run with: python -m unittest discover -s scripts -p test_machinery_orders.py"""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("machinery", ROOT / "scripts/import-machinery-orders.py")
machinery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(machinery)


class MachineryOrdersTests(unittest.TestCase):
    def table(self):
        rows = ["金額単位:百万円 内需計 外需 総額"]
        for year in (2019, 2020):
            for month in range(1, 13):
                label = f"{year}年{month}月" if month == 1 else f"{month}月"
                rows.append(label + " 1,000 1.0 2,000 ▲ 2.0 3,000 0.0 400 3.0 500 4.0 3,900 5.0 600 ▲ 6.0 4,500 7.0")
        return "\n".join(rows)

    def test_year_rollover_and_amount_columns(self):
        points = machinery.parse_table(self.table())
        self.assertEqual(points[0], dict(month="2019-01", domestic=3900, exports=600, total=4500))
        self.assertEqual(points[-1]["month"], "2020-12")

    def test_inconsistent_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            machinery.parse_table(self.table().replace("4,500", "4,501", 1))

    def test_incomplete_columns_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "columns"):
            machinery.parse_table(self.table().replace("600 ▲ 6.0", "600", 1))

    def test_published_data_is_continuous_and_traceable(self):
        data = json.loads((ROOT / "lib/reports/data/machinery-orders.json").read_text(encoding="utf-8"))
        points = data["points"]
        indices = [int(p["month"][:4]) * 12 + int(p["month"][5:]) for p in points]
        self.assertEqual(indices, list(range(indices[0], indices[-1] + 1)))
        self.assertEqual(points[0]["month"], data["firstMonth"])
        self.assertEqual(points[-1]["month"], data["latestMonth"])
        sources = {s["month"]: s for s in data["sources"]}
        for point in points:
            self.assertEqual(point["domestic"] + point["exports"], point["total"])
            self.assertIn(point["sourceMonth"], sources)
            self.assertLessEqual(point["month"], point["sourceMonth"])
        self.assertEqual(points[-1]["total"], 494703)
        self.assertEqual(points[-1]["domestic"], 308175)
        self.assertEqual(points[-1]["exports"], 186528)


if __name__ == "__main__":
    unittest.main()
