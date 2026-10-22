import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("ports", Path(__file__).with_name("import-port-trade.py"))
ports = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ports)


class PortTradeTests(unittest.TestCase):
    def source(self, old_april=False):
        months = ["Apl" if old_april and month == "Apr" else month for month in ports.MONTHS]
        header = ["Exp or Imp", "Year", "Custom", "HS", "Country", "Value-Year"] + ["Value-" + month for month in months]
        rows = [["1", "2000", "104", "'010000000'", "103", "999999"] + [str(i) for i in range(1, 13)],
                ["1", "2000", "104", "'020000000'", "105", "999999"] + ["2"] * 12,
                ["1", "2000", "200", "'010000000'", "103", "999999"] + ["4"] * 12]
        return ("\r\r\n".join(",".join(row) for row in [header] + rows)).encode("cp932")

    def test_sums_disjoint_monthly_details_without_annual_values(self):
        values = ports.parse_detail(self.source(), 2000, 1)
        self.assertEqual(values["104"], [i + 2 for i in range(1, 13)])
        self.assertEqual(values["200"], [4] * 12)
        self.assertEqual(sum(v[0] for v in values.values()), 7)

    def test_accepts_historical_april_spelling(self):
        self.assertEqual(ports.parse_detail(self.source(True), 2000, 1)["104"][3], 6)

    def test_rejects_wrong_period_and_direction(self):
        for year, direction in [(2001, 1), (2000, 2)]:
            with self.assertRaises(ValueError):
                ports.parse_detail(self.source(), year, direction)

    def test_rejects_missing_month_and_invalid_amount(self):
        for content in [self.source().replace(b"Value-Dec", b"Missing"), self.source().replace(b",999999,1,", b",999999,n.a.,")]:
            with self.assertRaises(ValueError):
                ports.parse_detail(content, 2000, 1)


if __name__ == "__main__":
    unittest.main()
