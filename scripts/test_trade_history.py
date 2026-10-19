import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("trade", Path(__file__).with_name("import-trade-history.py"))
trade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trade)


class TradeImportTests(unittest.TestCase):
    def releases(self):
        rows = []
        for index in range(60):
            month = f"{2021 + index // 12:04d}-{index % 12 + 1:02d}"
            series = {key: {"total": 1000, "values": {"A": 100, "B": 90, "C": 80, "D": 70, "E": 60, "F": 50}, "unlistedUpperBound": 10}
                      for key in ("country-export", "country-import", "commodity-export", "commodity-import")}
            rows.append({"month": month, "sourceUrl": "https://www.customs.go.jp/test.xml", "sourceTitle": "test", "published": "test", "series": series})
        return rows

    def test_monthly_links_exclude_partial_and_annual(self):
        parser = trade.Releases()
        parser.feed('<a title="2025.9" href="./trade-st/2025/2025097.xml"></a><a title="2025.09" href="./trade-st/2025/2025091.xml"></a><a title="2025CY" href="./trade-st/2025/2025_117.xml"></a>')
        self.assertEqual(list(parser.links), ["2025-09"])

    def test_latest_ranking_is_fixed_and_residual_reconciles(self):
        rows = self.releases()
        for series in rows[-1]["series"].values():
            series["values"]["F"] = 110
        chart = trade.build_snapshot(rows)["charts"][0]
        self.assertEqual(chart["categories"], ["F", "A", "B", "C", "D", "その他"])
        self.assertEqual(chart["points"][0]["values"][0], 50)
        self.assertEqual(chart["points"][-1]["values"][0], 110)
        for point in chart["points"]:
            self.assertEqual(sum(point["values"]), point["total"])

    def test_missing_month_is_rejected(self):
        rows = self.releases()
        rows[20] = copy.deepcopy(rows[19])
        with self.assertRaises(ValueError):
            trade.build_snapshot(rows)

    def test_uncertain_country_ranking_is_rejected(self):
        rows = self.releases()
        rows[-1]["series"]["country-export"]["unlistedUpperBound"] = 61
        with self.assertRaises(ValueError):
            trade.build_snapshot(rows)


if __name__ == "__main__":
    unittest.main()
